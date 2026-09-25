-- Seed data. Every code here is hand-assigned so no two collide.
-- Change these BEFORE you print your first tag; after that they are frozen.

insert into size_group (code, name) values
    ('LETTER', 'Letter sizes (tops)'),
    ('WAIST',  'Waist sizes (jeans, trousers)'),
    ('FREE',   'Free size');

insert into clothing_size (size_group_id, code, name, sort_order)
select id, v.code, v.name, v.ord from size_group g,
    (values ('S','Small',1), ('M','Medium',2), ('L','Large',3),
            ('XL','Extra Large',4), ('XXL','Double XL',5), ('3XL','Triple XL',6)
    ) as v(code, name, ord)
where g.code = 'LETTER';

insert into clothing_size (size_group_id, code, name, sort_order)
select id, v.code, v.name, v.ord from size_group g,
    (values ('28','28',1), ('30','30',2), ('32','32',3), ('34','34',4),
            ('36','36',5), ('38','38',6), ('40','40',7), ('42','42',8)
    ) as v(code, name, ord)
where g.code = 'WAIST';

insert into clothing_size (size_group_id, code, name, sort_order)
select id, 'FS', 'Free Size', 1 from size_group where code = 'FREE';

-- Article types, from your list. JN/JK/TP/HF/SN chosen to stay distinct.
insert into article_type (code, name, size_group_id, sort_order)
select v.code, v.name, g.id, v.ord
from (values
    ('TS', 'T-Shirt',    'LETTER', 1),
    ('SH', 'Shirt',      'LETTER', 2),
    ('JN', 'Jean',       'WAIST',  3),
    ('JK', 'Jacket',     'LETTER', 4),
    ('TP', 'Trackpant',  'LETTER', 5),
    ('HF', 'Half Sleeve','LETTER', 6),
    ('SN', 'Sando',      'LETTER', 7)
) as v(code, name, grp, ord)
join size_group g on g.code = v.grp;

insert into material (code, name, sort_order) values
    ('CT', 'Cotton',      1),
    ('PC', 'Poly Cotton', 2),
    ('PL', 'Polyester',   3),
    ('DN', 'Denim',       4),
    ('LN', 'Linen',       5),
    ('RY', 'Rayon',       6),
    ('SK', 'Silk',        7),
    ('WL', 'Wool',        8),
    ('LY', 'Lycra',       9),
    ('VS', 'Viscose',    10),
    ('NY', 'Nylon',      11),
    ('FL', 'Fleece',     12);

-- NOTE: BLACK is BL and BLUE is BU. Naive "first two letters" gives BL for both.
insert into colour (code, name, hex, sort_order) values
    ('BL', 'Black',  '#111111',  1),
    ('WH', 'White',  '#FFFFFF',  2),
    ('BU', 'Blue',   '#2563EB',  3),
    ('NV', 'Navy',   '#1E3A5F',  4),
    ('GY', 'Grey',   '#8A8F98',  5),
    ('RD', 'Red',    '#C62828',  6),
    ('GR', 'Green',  '#2E7D32',  7),
    ('YL', 'Yellow', '#F2C200',  8),
    ('BR', 'Brown',  '#6B4A2F',  9),
    ('BG', 'Beige',  '#D9C7A7', 10),
    ('MR', 'Maroon', '#7B1F2B', 11),
    ('PK', 'Pink',   '#E48AA8', 12),
    ('OR', 'Orange', '#E1701A', 13),
    ('CR', 'Cream',  '#F3EAD6', 14),
    ('OV', 'Olive',  '#6B7238', 15),
    ('PR', 'Purple', '#6B4A9E', 16);

insert into location (code, name, type) values ('MAIN', 'Shop Floor', 'FLOOR');

insert into app_setting (key, value) values
    ('pricing.default_markup', '2.0'),
    ('pricing.markup_editable', 'true');
