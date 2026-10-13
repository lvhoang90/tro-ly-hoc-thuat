# Bản YouTube của clip "Ami 1.6: có gì mới" (16:9, 1920×1080, 60 giây)

Tệp đăng YouTube (không đưa vào kho vì nặng, dựng lại theo các bước dưới):
- `ami-1.6-youtube-1080p.mp4`: H.264 High 4.2, 1920×1080, 30 khung/giây, yuv420p, màu BT.709, khoảng 6 Mb/giây (đỉnh tối đa 16 Mb/giây); âm thanh AAC-LC 48 kHz stereo 256–384 kb/giây, âm lượng chuẩn −14 LUFS (mức YouTube chuẩn hóa), đỉnh âm dưới −1,5 dBTP; `moov` ở đầu tệp (phát được ngay khi đang tải).
- `ami-1.6-youtube-thumbnail.jpg`: ảnh đại diện 1280×720 (dưới 2 MB), dựng từ `thumb.html` bằng `node thumb.cjs <ra.jpg>`.
- `ami-1.6-youtube.vi.srt` và `.vtt`: phụ đề tiếng Việt tách rời (không in vào hình), tải ở mục Phụ đề của YouTube Studio.
- `youtube-metadata.md`: tiêu đề, mô tả có mốc chương, thẻ, cài đặt khi tải lên.

## Giọng đọc
ElevenLabs, giọng nam "Việt Hoàng - Hà Nội" (`voice_id` 1HUXO9mHGvudRxhAnNLk), mô hình `eleven_v4`, `language_code` **phải đặt `vi`**, `stability` 0,5, `similarity_boost` 0,8, `mp3_44100_128`. Lời trong `script.json`; độ dài từng đoạn ở `dur.json`. Khóa API lấy từ biến môi trường `ELEVENLABS_API_KEY`, không lưu trong kho. Âm thanh (nhạc nền, hiệu ứng, trộn với giọng) dùng chung `../moi60/audio60.py`.

## Dựng lại
1. Hình: `NODE_PATH=<nơi có playwright> node render.cjs <thư mục khung> 0 1800` (chia nhiều tiến trình theo đoạn khung). Mọi chuyển động là hàm của thời gian trong `yt.html` (`window.__render(t)`); cảnh và mốc thời gian trùng bản dọc `../moi60/index.html`.
2. Âm thanh: `python3 ../moi60/audio60.py <thư mục wav giọng> mix.wav`, rồi chuẩn hóa hai lượt: đo `loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`, áp lại với các giá trị đo và `linear=true`, `aresample=48000`, `-ac 2`.
3. Ghép: `ffmpeg -framerate 30 -i f%04d.jpg -i mix.wav -vf "scale=1920:1080:in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -profile:v high -level 4.2 -crf 16 -maxrate 16M -bufsize 32M -g 15 -bf 2 -r 30 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 384k -ar 48000 -ac 2 -movflags +faststart -shortest out.mp4`.

Phông Inter và Space Grotesk theo giấy phép SIL OFL 1.1.
