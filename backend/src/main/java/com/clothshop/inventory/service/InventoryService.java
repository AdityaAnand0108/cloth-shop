package com.clothshop.inventory.service;

import com.clothshop.common.ApiException;
import com.clothshop.inventory.domain.InventoryStock;
import com.clothshop.inventory.domain.Location;
import com.clothshop.inventory.domain.MovementType;
import com.clothshop.inventory.domain.StockLedger;
import com.clothshop.inventory.repository.InventoryStockRepository;
import com.clothshop.inventory.repository.LocationRepository;
import com.clothshop.inventory.repository.StockLedgerRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The ONLY way stock changes anywhere in this application.
 * <p>
 * Nothing else may touch {@code inventory_stock}. Every call appends a ledger row
 * and then updates the cache, in that order, in one transaction. If you find
 * yourself wanting to write an UPDATE against qty_on_hand somewhere else, the
 * answer is another method on this class.
 */
@Service
public class InventoryService {

    private final InventoryStockRepository stockRepo;
    private final StockLedgerRepository ledgerRepo;
    private final LocationRepository locationRepo;
    private final String defaultLocationCode;

    public InventoryService(InventoryStockRepository stockRepo,
                            StockLedgerRepository ledgerRepo,
                            LocationRepository locationRepo,
                            @Value("${app.inventory.default-location-code}") String defaultLocationCode) {
        this.stockRepo = stockRepo;
        this.ledgerRepo = ledgerRepo;
        this.locationRepo = locationRepo;
        this.defaultLocationCode = defaultLocationCode;
    }

    public Location defaultLocation() {
        return locationRepo.findByCode(defaultLocationCode)
                .orElseThrow(() -> ApiException.notFound("Default location " + defaultLocationCode));
    }

    /**
     * Append one movement and re-project the cached quantity.
     *
     * @param qtyDelta positive to bring stock in, negative to take it out
     * @param wholesalerId who supplied this lot, or null when the movement is not a purchase
     * @return the balance after this movement
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public BigDecimal post(Long variantId,
                           Long locationId,
                           MovementType type,
                           BigDecimal qtyDelta,
                           BigDecimal unitCost,
                           Long wholesalerId,
                           String refDocType,
                           String refDocId,
                           String note,
                           String user) {

        if (qtyDelta == null || qtyDelta.signum() == 0) {
            throw ApiException.badRequest("ZERO_MOVEMENT", "A stock movement of zero is not a movement");
        }

        InventoryStock stock = stockRepo.findByVariantIdAndLocationId(variantId, locationId)
                .orElseGet(() -> {
                    InventoryStock fresh = new InventoryStock();
                    fresh.setVariantId(variantId);
                    fresh.setLocationId(locationId);
                    fresh.setQtyOnHand(BigDecimal.ZERO);
                    return fresh;
                });

        BigDecimal balanceAfter = stock.getQtyOnHand().add(qtyDelta);
        if (balanceAfter.signum() < 0) {
            throw ApiException.conflict("INSUFFICIENT_STOCK",
                    "Only " + stock.getQtyOnHand().stripTrailingZeros().toPlainString() + " in stock",
                    Map.of("available", stock.getQtyOnHand(), "requested", qtyDelta.abs()));
        }

        StockLedger entry = new StockLedger();
        entry.setVariantId(variantId);
        entry.setLocationId(locationId);
        entry.setMovementType(type);
        entry.setQtyDelta(qtyDelta);
        entry.setBalanceAfter(balanceAfter);
        entry.setUnitCost(unitCost);
        entry.setWholesalerId(wholesalerId);
        entry.setRefDocType(refDocType);
        entry.setRefDocId(refDocId);
        entry.setNote(note);
        entry.setCreatedBy(user);
        ledgerRepo.save(entry);

        stock.setQtyOnHand(balanceAfter);
        stockRepo.save(stock);

        return balanceAfter;
    }

    @Transactional(readOnly = true)
    public BigDecimal onHand(Long variantId, Long locationId) {
        return stockRepo.findByVariantIdAndLocationId(variantId, locationId)
                .map(InventoryStock::getQtyOnHand)
                .orElse(BigDecimal.ZERO);
    }

    /** Bulk lookup for list screens, so a table of 200 rows is one query and not 200. */
    @Transactional(readOnly = true)
    public Map<Long, BigDecimal> onHandByVariant(List<Long> variantIds) {
        Map<Long, BigDecimal> result = new HashMap<>();
        if (variantIds == null || variantIds.isEmpty()) {
            return result;
        }
        for (InventoryStock s : stockRepo.findByVariantIdIn(variantIds)) {
            result.merge(s.getVariantId(), s.getQtyOnHand(), BigDecimal::add);
        }
        return result;
    }
}
