INSERT INTO storage.buckets (id, name, public) VALUES ('albaranes-proveedor', 'albaranes-proveedor', false);

CREATE POLICY "Authenticated users can upload delivery notes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'albaranes-proveedor');

CREATE POLICY "Authenticated users can read delivery notes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'albaranes-proveedor');