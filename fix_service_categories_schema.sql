services:273 
 GET https://enqghdbndotdhtvmbode.supabase.co/rest/v1/system_settings?select=set…setting_key=eq.hourly_rate&shop_id=eq.1c74d8b8-66bf-45ea-8246-73d7602a0f2b 404 (Not Found)

services:240 Fetch error from https://enqghdbndotdhtvmbode.supabase.co/rest/v1/system_settings?select=set…setting_key=eq.hourly_rate&shop_id=eq.1c74d8b8-66bf-45ea-8246-73d7602a0f2b: {"code":"PGRST205","details":null,"hint":"Perhaps you meant the table 'public.team_member_services'","message":"Could not find the table 'public.system_settings' in the schema cache"}
services:240 Error fetching hourly rate: 
{code: 'PGRST205', details: null, hint: "Perhaps you meant the table 'public.team_member_services'", message: "Could not find the table 'public.system_settings' in the schema cache"}
services:273 
 GET https://enqghdbndotdhtvmbode.supabase.co/rest/v1/service_categories?select=…5ea-8246-73d7602a0f2b&is_active=eq.true&order=display_order.asc%2Cname.asc 400 (Bad Request)
services:240 Fetch error from https://enqghdbndotdhtvmbode.supabase.co/rest/v1/service_categories?select=…5ea-8246-73d7602a0f2b&is_active=eq.true&order=display_order.asc%2Cname.asc: {"code":"42703","details":null,"hint":null,"message":"column service_categories.is_active does not exist"}
services:240 Error fetching categories: 
{code: '42703', details: null, hint: null, message: 'column service_categories.is_active does not exist'}
﻿