# BVA 2245 teslim kontrolü

Bu liste, 30.10.2026 tarihli ödev kartı ve depodaki doğrulanabilir kanıtlara göre tutulur. Gerçekleşmeyen test veya video tamamlanmış gibi işaretlenmez.

## Tamamlanan / depoda bulunanlar
- [x] Herkese açık GitHub deposu.
- [x] Vercel canlı ürün bağlantısı.
- [x] Dört KPI kartı, ana grafik, ikincil grafik ve sıralanabilir/filtrelenebilir detay tablosu.
- [x] 12 aylık mevsimsel ortalama tahmini ve ±1 örnek standart sapma bandı.
- [x] Aynı takvim gününün tarihsel kayıtlarda bulunan son 10 yıllık karşılaştırması.
- [x] Grafik açıklamaları ve tablo alternatifleri.
- [x] Yükleniyor, boş sonuç ve canlı API hata durumları.
- [x] Günlük GitHub Actions veri snapshot iş akışı ve son başarılı snapshot'ı kullanma kodu.
- [x] README'de mimari, kaynaklar, kurulum, lisans notu, CV cümlesi ve yapay zekâ beyanı.
- [x] Portfolyoda vaka çalışması sayfası ve projeler kartından bağlantı.
- [x] Üç farklı cihazda bağlantı açılma ön kontrolü.
- [x] Build check workflow'u başarılı çalışıyor.

## Henüz tamamlanmayanlar
- [ ] Günlük veri workflow'unun yeni fallback sürümüyle başarılı çalıştığına dair Actions ekran görüntüsü. Önceki denemeler resmî API zaman aşımı nedeniyle başarısız olmuştu.
- [ ] İki hedef kullanıcıyla üç görevli gerçek kullanılabilirlik testi; her görev için başarı, süre ve takılma noktası.
- [ ] Test sonrası en az bir değişikliğin önce/sonra ekran görüntüsü.
- [ ] Lighthouse mobil raporu: erişilebilirlik ≥ 90 ve performans ≥ 80. Paylaşılan ön ölçümde 58 / 100 görülmüştü; performans iyileştirmesi gerekiyor.
- [ ] 60–90 saniyelik demo videosunun kaydedilmesi ve portfolyo sayfasına eklenmesi.
- [ ] En az 15 anlamlı commit mevcut; ancak GitHub geçmişi şu anda yalnızca 29–30 Ekim 2026 günlerine yayılıyor. Dört farklı gün şartı geçmiş tarihlere sahte commit ekleyerek karşılanmamalıdır.
- [ ] Final teslim formuna canlı ürün, GitHub, portfolyo vaka sayfası, video ve Lighthouse kanıt bağlantılarının eklenmesi.

## Kullanıcı testi görevleri
1. Ömerli barajının seçilen tarih aralığındaki doluluk eğilimini bul.
2. 12 aylık tahmin çizgisi ile belirsizlik bandını açıkla.
3. Son tarihsel ölçüm gününün geçmiş yıllardaki karşılaştırmasını bul.

Kayıt formu: [kullanici-testi.md](kullanici-testi.md)
Demo metni: [demo-video-metni.md](demo-video-metni.md)
