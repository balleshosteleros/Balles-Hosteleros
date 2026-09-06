-- Un mismo sabor de shisha se escribia distinto en cada local, asi que la
-- carta parecia ofrecer cosas diferentes y los cruces entre empresas fallaban:
--   "AL Kaher Yellow" / "Al Kaher Yelow"   (ademas de la errata en Yelow)
--   "Miis Jossy"      / "MissJossy"
--   "MY Amor"         / "My amor"
--   "Catton Candy"    -> es Cotton Candy
update public.carta_items set nombre='Al Kaher Yellow', updated_at=now()
where nombre in ('AL Kaher Yellow','Al Kaher Yelow');

update public.carta_items set nombre='Miss Jossy', updated_at=now()
where nombre in ('Miis Jossy','MissJossy');

update public.carta_items set nombre='My Amor', updated_at=now()
where nombre in ('MY Amor','My amor');

update public.carta_items set nombre='Cotton Candy', updated_at=now()
where nombre='Catton Candy';
