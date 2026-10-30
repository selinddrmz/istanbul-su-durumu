# İstanbul Su Durumu

İstanbul barajlarının tarihsel doluluk verilerini keşfetmek, mevsimsel örüntüleri incelemek ve geçmiş ölçümlere dayalı basit bir 12 aylık tahmini değerlendirmek için hazırlanmış editoryal veri ürünüdür.

> Bu proje eğitim ve bilgilendirme amaçlıdır. Resmî İSKİ uygulaması değildir; su yönetimi tavsiyesi veya resmî tahmin sunmaz.

## Canlı ürün

- **Uygulama:** https://istanbul-su-durumu-ivbw.vercel.app
- **GitHub:** https://github.com/selinddrmz/istanbul-su-durumu

## Problem ve kullanıcı

Kurgusal müşteri bir çevre haber sitesidir. Hedef kullanıcılar kuraklık haberleri hazırlayan muhabirler ve İstanbul'daki su durumunu anlamak isteyen okurlardır. Arayüz, editoryal gazete tipografisi ve okunabilir metin genişliğiyle KPI → grafik → tablo akışını izler.

## Özellikler

- İstanbul barajları için 23.10.2000–19.02.2024 tarihsel günlük kayıtları.
- Güncel doluluk oranı için ayrı bir canlı veri kartı; ölçüm tarihi, kaynak ve kaynak atfı birlikte gösterilir.
- Baraj ve yıl aralığı filtreleri; tarih arama ve sütun başlığına tıklayarak sıralama.
- Tarihsel zaman serisi, barajlar arası tarihsel ortalamalar ve aylık/mevsimsel görünüm.
- Seçilen tarih aralığındaki aynı takvim aylarının ortalamasını kullanan 12 aylık basit tahmin. Belirsizlik bandı ±1 örnek standart sapmadır ve 0–100% aralığında tutulur.
- Tarihsel veri setindeki son ölçümün aynı ay/gününe ait geçmiş 10 yıl karşılaştırması.
- Grafik özeti, grafik verisini tablo olarak görüntüleme seçeneği, yükleniyor/hata/boş durumları.
- Dar ekranlarda taşmayı önleyen duyarlı sayfa düzeni.

## Veri kaynakları ve güncellik

### Tarihsel veri
- Kaynak: [İBB Açık Veri Portalı – İstanbul Barajları Günlük Doluluk Oranları](https://data.ibb.gov.tr/dataset/istanbul-barajlari-gunluk-doluluk-oranlari)
- Depo dosyası: `public/baraj-doluluk.json`
- Dosyadaki tarihsel aralık: 23 Ekim 2000 – 19 Şubat 2024.
- Tarihsel veri son ölçüm tarihi, güncel doluluk oranı olarak yorumlanmamalıdır.

### Canlı veri
- Uygulama önce İSKİ'nin baraj doluluk API'sini dener.
- Resmî uç nokta yanıt vermediğinde [dolulukorani.com'un İstanbul geçmiş verisi API'si](https://www.dolulukorani.com/api/v1/provinces/istanbul/history?days=30) yedek kaynak olarak kullanılır.
- Sunucu tarafındaki Next.js uç noktası: `/api/iski`.
- Canlı kart, kaynağın ölçüm tarihini gösterir. Kaynak verinin güncelliği ölçüm tarihine göre değerlendirilmelidir.
- Yedek kaynak, kendi atıf bilgisinde verileri resmî kurum kaynaklarından derlediğini belirtir; uygulama bunu doğrudan İSKİ API'si gibi sunmaz.

## Tahmin yöntemi ve sınırları

Her gelecek ay için, seçilen tarih aralığında aynı takvim ayına denk gelen tarihsel ölçümlerin ortalaması hesaplanır. Belirsizlik aralığı ortalama ±1 örnek standart sapmadır; alt/üst sınırlar 0 ve 100 yüzde ile sınırlandırılır.

Bu yaklaşım basit bir mevsimsel referanstır. Yağış, buharlaşma, nüfus tüketimi, su transferleri, işletme kararları veya meteorolojik tahminleri modellemez. Bu nedenle geleceğe ilişkin kesin sonuç veya resmî tahmin değildir. Aynı gün karşılaştırmasında veri setinde bulunmayan tarihler gösterilmez.

## Mimari

```mermaid
flowchart TD
  A[İBB tarihsel açık veri] --> B[public/baraj-doluluk.json]
  B --> C[Next.js istemci uygulaması]
  D[Kullanıcı tarayıcısı] --> C
  C --> E[Filtreler ve Recharts görselleştirmeleri]
  C --> F[/api/iski]
  F --> G[İSKİ canlı API]
  F --> H[dolulukorani.com yedek API]
  G --> I[Canlı doluluk kartı]
  H --> I
```

## Teknolojiler

- Next.js 16, React 19, TypeScript
- Tailwind CSS
- Recharts
- Vercel dağıtımı
- GitHub

## Yerel kurulum

Gereksinim: Node.js LTS ve npm.

```bash
git clone https://github.com/selinddrmz/istanbul-su-durumu.git
cd istanbul-su-durumu
npm install
npm run dev
```

Tarayıcıda http://localhost:3000 adresini açın.

Üretim derlemesini kontrol etmek için:

```bash
npm run build
npm run start
```

## Lisans ve atıf

Tarihsel veri İBB Açık Veri Portalı'ndan alınmıştır; veri setinin portalda belirtilen lisans ve atıf koşulları geçerlidir. Canlı yedek API yanıtı CC BY 4.0 lisans/atıf bilgisini beyan eder; yeniden kullanımda kaynağın güncel koşulları kontrol edilmelidir. Uygulama kodu için bu depoda ayrıca bir açık kaynak lisansı tanımlanmamıştır.

## Yapay zekâ kullanım beyanı

ChatGPT; hata ayıklama, kod değişiklikleri için öneri, dokümantasyon taslağı ve açıklamaların hazırlanmasında yardımcı araç olarak kullanılmıştır. Proje sahibi önerileri kendi deposundaki kod ve veriyle karşılaştırmalı, uygulamayı çalıştırmalı ve demo sırasında kullanılan veri akışını, tahmin yöntemini ve sınırlılıkları açıklayabilmelidir.

## CV için proje cümlesi

İBB tarihsel baraj verileri ve ayrı bir canlı veri kaynağıyla İstanbul su durumunu izleyen; Next.js, TypeScript ve Recharts kullanarak filtrelenebilir grafikler, mevsimsel tahmin ve belirsizlik bandı sunan duyarlı bir editoryal veri ürünü geliştirdim.

## Geliştirme notları

- Kaynak API'ler zaman zaman erişilemeyebilir veya gecikebilir. Canlı veri kartı tarihsel seriden ayrıdır.
- Tarihsel dosya güncel veri değildir; canlı bağlantı başarısız olduğunda bu ayrım korunur.
- Gerçek kullanıcı testi, Lighthouse ölçümü ve demo kaydı sonuçları yalnızca gerçekten yapıldıktan sonra rapora eklenmelidir.
