# TO Screen Recorder

TO Screen Recorder is a sleek, minimalist screen recording and image editing tool based on Electron.js, designed for Windows. It was developed to capture specific regions of the screen (MP4) or take screenshots and quickly annotate them (highlighter, drawing, text).

## Features
- **Regional or Full Screen Recording:** Freely select the recording area.
- **System Audio Recording:** Captures desktop audio in high quality.
- **Various Quality Options:** SD, HD, and 4K resolution settings.
- **Built-in Image Editor:** Edit captured screenshots with pen, eraser, text tool, and semi-transparent "highlighter (marker)".
- **Hardware Acceleration:** Uses `ffmpeg` for fast output in video processing.

## Requirements
To run or compile the project in your local environment, the following software must be installed on your computer:
1. **Node.js** (v16.x or higher recommended)
2. **NPM** (comes with Node.js)
3. **FFmpeg Engine:** Video conversion and image capture processes are done directly with FFmpeg. Therefore, you must provide the `ffmpeg.exe` file.

## Installation and Execution
1. **Clone the Project:**
   ```bash
   git clone https://github.com/yunusnt/TO-Screen-Recorder-Snipping-Tool.git
   cd TO-Screen-Recorder-Snipping-Tool
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **FFmpeg Setup (CRITICAL):**
   - [Download FFmpeg](https://ffmpeg.org/download.html) (Windows build).
   - Extract the `ffmpeg.exe` file from the downloaded archive.
   - Create a folder named `bin` in the project root directory (if it doesn't exist).
   - Copy the `ffmpeg.exe` file into this `bin` folder (`bin/ffmpeg.exe`).
4. **Start the Application (Developer Mode):**
   ```bash
   npm start
   ```

## Packaging (Build)
To turn the application into a standalone `.exe` file:
```bash
npm run dist
```
**Note:** When distributing, to ensure `ffmpeg.exe` works on the end user's computer, it must be added next to (or inside) the application under a folder named `FFMPEG`, or the directory hierarchy specified in the developer code must be followed (check the `getFfmpegPath` function in the `main.js` file).

## Modules / Libraries Used
- **Electron** (`^41.1.1` or current version): Desktop application framework.
- **fluent-ffmpeg** (`^2.1.3`): For communicating with FFmpeg via Node.js.
- **electron-builder** (DevDependency): Used to package the application for Windows (or other OSs).

## Contributing
If you want to improve the project, you can submit a Pull Request (PR). You can examine the CSS/JS files for the interface and `main.js` for background tasks.

---
*Developer Note: This tool is open source and developed with a minimalist approach to speed up system operations.*

<br>

---

# TO Screen Recorder (TR)

TO Screen Recorder, Windows için tasarlanmış, Electron.js tabanlı şık ve minimalist bir ekran kayıt ve görüntü düzenleme aracıdır. Ekranda belli bir bölgenin kaydını almak (MP4) veya ekran görüntüsü alıp üzerinde hızlıca işaretlemeler yapmak (vurgulayıcı, çizim, metin) için geliştirilmiştir.

## Ozellikler
- **Bölgesel veya Tam Ekran Kayıt:** Kayıt alanını özgürce seçin.
- **Sistem Sesi Kaydı:** Masaüstü seslerini yüksek kalitede yakalar.
- **Farklı Kalite Seçenekleri:** SD, HD ve 4K çözünürlük ayarları.
- **Dahili Görsel Düzenleyici:** Alınan ekran görüntüleri üzerinde kalem, silgi, metin aracı ve yarı saydam "vurgulayıcı (marker)" ile düzenleme yapabilme.
- **Donanım Hızlandırma:** Video işlemlerinde `ffmpeg` kullanılarak hızlı çıktı alınması.

## Gereksinimler

Projeyi yerel ortamınızda çalıştırmak veya derlemek için aşağıdaki yazılımların bilgisayarınızda yüklü olması gerekir:

1. **Node.js** (v16.x veya üzeri önerilir)
2. **NPM** (Node.js ile birlikte gelir)
3. **FFmpeg Motoru:** Video dönüştürme ve görsel alma işlemleri doğrudan FFmpeg ile yapılır. Bu yüzden `ffmpeg.exe` dosyasını temin etmelisiniz.

## Kurulum ve Calistirma

1. **Projeyi Klonlayın:**
   ```bash
   git clone https://github.com/yunusnt/TO-Screen-Recorder-Snipping-Tool.git
   cd TO-Screen-Recorder-Snipping-Tool
   ```

2. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```

3. **FFmpeg Ayarı (KRITIK):**
   - [FFmpeg'i indirin](https://ffmpeg.org/download.html) (Windows build).
   - İndirdiğiniz arşivden `ffmpeg.exe` dosyasını çıkarın.
   - Proje ana dizininde `bin` adında bir klasör oluşturun (eğer yoksa).
   - `ffmpeg.exe` dosyasını bu `bin` klasörünün içine kopyalayın (`bin/ffmpeg.exe`).

4. **Uygulamayı Başlatın (Geliştirici Modu):**
   ```bash
   npm start
   ```

## Paketleme (Build)

Uygulamayı bağımsız bir `.exe` dosyası haline getirmek isterseniz:

```bash
npm run dist
```

**Not:** Dağıtım yaptığınızda, `ffmpeg.exe`'nin son kullanıcının bilgisayarında da çalışabilmesi için, çıkan uygulamanın yanına (veya içine) `FFMPEG` klasörü adı altında eklenmesi veya geliştirici kodunda belirtilen dizin hiyerarşisine sadık kalınması gerekmektedir (`main.js` dosyasındaki `getFfmpegPath` fonksiyonuna göz atın).

## Kullanilan Moduller / Kutuphaneler

- **Electron** (`^41.1.1` veya güncel sürümü): Masaüstü uygulama çatısı.
- **fluent-ffmpeg** (`^2.1.3`): Node.js üzerinden FFmpeg ile haberleşmek için.
- **electron-builder** (DevDependency): Uygulamayı Windows (veya diğer OS'ler) için paketlemek amacıyla kullanılır.

## Katkida Bulunma
Projeyi geliştirmek isterseniz Pull Request (PR) gönderebilirsiniz. Arayüz için CSS/JS ve arka plan işleri için `main.js` dosyalarını inceleyebilirsiniz.

---
*Geliştirici Notu: Bu araç açık kaynaklıdır ve sistem operasyonlarını hızlandırmak amacıyla minimalist bir yaklaşımla geliştirilmiştir.*
