-- Fase de demonstração (decisão do proprietário, 9 out 2026): permite publicar com o tratamento de
-- IVA "por indicar". O site mostra "IVA a confirmar no stand". Para voltar a exigir, repor a
-- verificação de vat_regime = 'unknown' nesta função.
create or replace function app.vehicle_publish_rules() returns trigger
language plpgsql as $$
begin
  if new.status in ('available', 'reserved') then
    if new.price_cents is null then
      raise exception 'Uma viatura disponível precisa de preço.' using errcode = 'check_violation';
    end if;
    if new.first_registration_year is null or new.mileage_km is null or new.fuel is null or new.transmission is null then
      raise exception 'Ano, quilometragem, combustível e caixa são obrigatórios para publicar.' using errcode = 'check_violation';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  if new.status = 'sold' and new.sold_at is null then
    new.sold_at := now();
  end if;
  if new.status <> 'sold' then
    new.sold_at := null;
  end if;
  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;
  if new.status = 'sold' or new.status = 'archived' or new.status = 'draft' then
    new.is_featured := false;
  end if;
  return new;
end $$;
