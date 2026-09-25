package com.clothshop.catalog.web;

import com.clothshop.catalog.dto.ArticleDtos.AddArticleRequest;
import com.clothshop.catalog.dto.ArticleDtos.AddArticleResponse;
import com.clothshop.catalog.dto.ArticleDtos.ArticleDetail;
import com.clothshop.catalog.dto.ArticleDtos.ArticleFilter;
import com.clothshop.catalog.dto.ArticleDtos.ArticleListItem;
import com.clothshop.catalog.dto.ArticleDtos.PreviewRequest;
import com.clothshop.catalog.dto.ArticleDtos.PreviewResponse;
import com.clothshop.catalog.service.ArticleService;
import com.clothshop.platform.service.IdempotencyService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/articles")
public class ArticleController {

    private final ArticleService articles;
    private final IdempotencyService idempotency;

    public ArticleController(ArticleService articles, IdempotencyService idempotency) {
        this.articles = articles;
        this.idempotency = idempotency;
    }

    /** Live code preview under the form, plus the duplicate warning. */
    @PostMapping("/preview-code")
    public PreviewResponse preview(@Valid @RequestBody PreviewRequest request) {
        return articles.preview(request);
    }

    /**
     * Create the article or add stock to it. A replayed Idempotency-Key returns the
     * original answer instead of adding the quantity a second time.
     */
    @PostMapping
    public AddArticleResponse add(@Valid @RequestBody AddArticleRequest request,
                                  @RequestHeader(value = "Idempotency-Key", required = false) String key) {

        return idempotency.replay(key, AddArticleResponse.class).orElseGet(() -> {
            AddArticleResponse response = articles.add(request);
            idempotency.remember(key, "POST /api/v1/articles", response);
            return response;
        });
    }

    /** Everything known about one article, for deciding what to charge for it. */
    @GetMapping("/{id}")
    public ArticleDetail detail(@PathVariable Long id) {
        return articles.detail(id);
    }

    /** Browse screen: free-text search plus any combination of the five dropdowns. */
    @GetMapping
    public Page<ArticleListItem> list(@RequestParam(required = false) String q,
                                      @RequestParam(required = false) Long articleTypeId,
                                      @RequestParam(required = false) Long brandId,
                                      @RequestParam(required = false) Long materialId,
                                      @RequestParam(required = false) Long colourId,
                                      @RequestParam(required = false) Long sizeId,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "25") int size) {

        ArticleFilter filter = new ArticleFilter(q, articleTypeId, brandId, materialId, colourId, sizeId);
        return articles.list(filter, PageRequest.of(page, Math.min(size, 200),
                Sort.by(Sort.Direction.DESC, "id")));
    }
}
