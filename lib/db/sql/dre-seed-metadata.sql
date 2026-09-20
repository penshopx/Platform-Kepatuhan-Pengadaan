INSERT INTO legal_sources (
  regulation_code,
  regulation_type,
  number,
  year,
  title,
  issuing_authority,
  authority_level,
  effective_date,
  is_binding,
  status,
  verification_status
) VALUES
(
  'PERPRES-46-2025',
  'PERPRES',
  '46',
  2025,
  '[UNVERIFIED] Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah',
  'Presiden Republik Indonesia',
  1,
  NULL,
  true,
  'ACTIVE',
  'UNVERIFIED'
),
(
  'PERMENPERIN-35-2025',
  'PERMENPERIN',
  '35',
  2025,
  '[UNVERIFIED] Peraturan Menteri Perindustrian Nomor 35 Tahun 2025',
  'Kementerian Perindustrian Republik Indonesia',
  2,
  NULL,
  true,
  'ACTIVE',
  'UNVERIFIED'
)
ON CONFLICT (regulation_code) DO NOTHING;