#!/bin/bash

# Supabase Storage Policy Fix Script
# This script fixes the RLS policies for the avatars bucket

SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcHJrYmVrZHF3ZHZ2eG5yeXplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDAyMDg1MiwiZXhwIjoyMDc1NTk2ODUyfQ.8wHDMtC9Qbgdef15hUSuc9_laj4sw3YZTKktAau_-fY"
PROJECT_URL="https://nfprkbekdqwdvvxnryze.supabase.co"

echo "🔧 Fixing Supabase Storage RLS Policies..."

# Execute SQL to drop old policies and create new ones
curl -X POST "${PROJECT_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "DROP POLICY IF EXISTS \"Public avatar access\" ON storage.objects; DROP POLICY IF EXISTS \"Authenticated users can upload avatars\" ON storage.objects; DROP POLICY IF EXISTS \"Authenticated users can update avatars\" ON storage.objects; DROP POLICY IF EXISTS \"Authenticated users can delete avatars\" ON storage.objects; DROP POLICY IF EXISTS \"Users can upload own avatar\" ON storage.objects; DROP POLICY IF EXISTS \"Users can update own avatar\" ON storage.objects; DROP POLICY IF EXISTS \"Users can delete own avatar\" ON storage.objects; CREATE POLICY \"Public can view avatars\" ON storage.objects FOR SELECT TO public USING (bucket_id = '\''avatars'\''); CREATE POLICY \"Authenticated can upload avatars\" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = '\''avatars'\''); CREATE POLICY \"Authenticated can update avatars\" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = '\''avatars'\''); CREATE POLICY \"Authenticated can delete avatars\" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = '\''avatars'\'');"
  }'

echo ""
echo "✅ Done! Policies should be updated."
echo "🧪 Try uploading your club logo again at http://localhost:5173/dashboard/profile"
