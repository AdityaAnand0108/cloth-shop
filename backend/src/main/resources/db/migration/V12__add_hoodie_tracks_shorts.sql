-- Add requested clothing types to the article lookup.
insert into article_type (code, name, size_group_id, sort_order)
select v.code, v.name, g.id, v.sort_order
from (values
    ('HD', 'Hoodie', 10, 'LETTER'),
    ('TR', 'Tracks', 11, 'LETTER'),
    ('ST', 'Shorts', 12, 'WAIST')
) as v(code, name, sort_order, size_group_code)
join size_group g on g.code = v.size_group_code;
