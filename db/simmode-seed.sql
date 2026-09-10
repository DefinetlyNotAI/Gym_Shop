UPDATE platform_state SET cto_initialized_at=now(),normal_operations_locked=false,lockdown_reason_code=NULL;
UPDATE app_setting SET value='true'::jsonb WHERE key='platform.store_enabled';
UPDATE app_setting SET value='"NONE_REVIEWED"'::jsonb WHERE key='checkout.tax_policy';
UPDATE app_setting SET value='true'::jsonb WHERE key='delivery.cod_redelivery_policy_reviewed';

INSERT INTO account(id,email_normalized,password_hash,display_name,phone_e164,email_verified_at,phone_verified_at,status) VALUES
('00000000-0000-4000-8000-000000000001','customer@sim.gym-shop.local','SIMULATION_LOGIN_ONLY','Simulation Customer','+962790000001',now(),now(),'ACTIVE'),
('00000000-0000-4000-8000-000000000002','cto@sim.gym-shop.local','SIMULATION_LOGIN_ONLY','Simulation CTO','+962790000002',now(),now(),'ACTIVE'),
('00000000-0000-4000-8000-000000000003','admin@sim.gym-shop.local','SIMULATION_LOGIN_ONLY','Simulation Admin','+962790000003',now(),now(),'ACTIVE'),
('00000000-0000-4000-8000-000000000004','driver@sim.gym-shop.local','SIMULATION_LOGIN_ONLY','Simulation Driver','+962790000004',now(),now(),'ACTIVE')
ON CONFLICT DO NOTHING;
INSERT INTO staff_account(account_id,role_id,status,mfa_completed_at) VALUES
('00000000-0000-4000-8000-000000000002','CTO','ACTIVE',now()),
('00000000-0000-4000-8000-000000000003','ADMIN','ACTIVE',now()),
('00000000-0000-4000-8000-000000000004','DELIVERY_AGENT','ACTIVE',now()) ON CONFLICT DO NOTHING;

INSERT INTO terms_document(id,kind,version,language,title,body,content_hash,published_at) VALUES
('10000000-0000-4000-8000-000000000001','TERMS','sim-v0.1','en','Simulation terms','This local simulation uses ephemeral data and simulated providers. No real order or payment is created.','sim-terms-en',now()),
('10000000-0000-4000-8000-000000000002','TERMS','sim-v0.1','ar','شروط المحاكاة','تستخدم هذه المحاكاة بيانات مؤقتة ومزودي خدمات وهميين. لا يتم إنشاء طلب أو دفعة حقيقية.','sim-terms-ar',now()),
('10000000-0000-4000-8000-000000000003','PRIVACY','sim-v0.1','en','Simulation privacy','All simulation state stays in process memory and is discarded on shutdown.','sim-privacy-en',now()),
('10000000-0000-4000-8000-000000000004','PRIVACY','sim-v0.1','ar','خصوصية المحاكاة','تبقى بيانات المحاكاة في ذاكرة العملية ويتم حذفها عند الإيقاف.','sim-privacy-ar',now()) ON CONFLICT DO NOTHING;

INSERT INTO delivery_zone(id,name_en,name_ar,fee_fils,eta_min_days,eta_max_days,active,policy_reviewed) VALUES('20000000-0000-4000-8000-000000000001','Amman Simulation Zone','منطقة محاكاة عمّان',2500,1,2,true,true) ON CONFLICT DO NOTHING;
INSERT INTO delivery_window(id,zone_id,weekday,starts_at,ends_at,capacity,active) VALUES('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1,'10:00','18:00',100,true) ON CONFLICT DO NOTHING;
INSERT INTO pickup_location(id,name_en,name_ar,address,hours,active) VALUES('20000000-0000-4000-8000-000000000003','Simulation Pickup','استلام المحاكاة','{"city":"Amman","area":"Simulation"}','{"daily":"10:00-18:00"}',true) ON CONFLICT DO NOTHING;
INSERT INTO category(id,slug,name_en,name_ar) VALUES('30000000-0000-4000-8000-000000000001','training','Training','تدريب') ON CONFLICT DO NOTHING;
INSERT INTO collection(id,slug,name_en,name_ar,description_en,description_ar) VALUES('30000000-0000-4000-8000-000000000002','simulation-drop','Simulation Drop','مجموعة المحاكاة','Memory-only sample products','منتجات تجريبية مؤقتة') ON CONFLICT DO NOTHING;
INSERT INTO product(id,slug,name_en,name_ar,description_en,description_ar,product_type,tags,attributes,status,base_price_fils,featured,published_at) VALUES
('40000000-0000-4000-8000-000000000001','simulation-training-shirt','Simulation Training Shirt','قميص تدريب تجريبي','A safe product for exercising the complete local order journey.','منتج آمن لتجربة رحلة الطلب المحلية.','Apparel',ARRAY['training','simulation'],'{"material":"performance knit"}','ACTIVE',18000,true,now()),
('40000000-0000-4000-8000-000000000002','simulation-bottle','Simulation Bottle','زجاجة تجريبية','A second in-memory catalog item.','منتج ثانٍ في الذاكرة.','Accessories',ARRAY['hydration','simulation'],'{"volume_ml":750}','ACTIVE',7500,false,now()) ON CONFLICT DO NOTHING;
INSERT INTO product_category(product_id,category_id,primary_category) VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true),('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',true) ON CONFLICT DO NOTHING;
INSERT INTO product_collection(product_id,collection_id) VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'),('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO product_variant(id,product_id,sku,option_values,enabled,purchasable,inventory_tracking) VALUES
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','SIM-SHIRT-M','{"Size":"M"}',true,true,true),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','SIM-BOTTLE','{}',true,true,true) ON CONFLICT DO NOTHING;
INSERT INTO inventory_balance(variant_id,on_hand,reserved) VALUES('50000000-0000-4000-8000-000000000001',25,0),('50000000-0000-4000-8000-000000000002',25,0) ON CONFLICT DO NOTHING;
