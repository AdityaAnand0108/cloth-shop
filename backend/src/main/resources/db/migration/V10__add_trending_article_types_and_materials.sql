-- Popular topwear variants and materials for current stock entries.
insert into article_type (code, name, size_group_id, sort_order)
select v.code, v.name, g.id, v.sort_order
from (values
    ('RN', 'Round Neck T-Shirt', 8),
    ('CT', 'Color T-Shirt',      9)
) as v(code, name, sort_order)
join size_group g on g.code = 'LETTER';

insert into material (code, name, sort_order) values
    ('AW', 'Acid Wash',    13),
    ('TC', 'Terry Cotton', 14);
