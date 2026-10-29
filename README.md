# Emine Gözel — VPS portfolyo

İnternet Programcılığı Sunucu Yönetimi dersi için hazırlanmış bağımsız kopya.
Mevcut Sites sürümü ve eski GitHub portfolyosu değiştirilmedi.

## Yapı

- `public/`: mevcut portfolyonun HTML, CSS, JavaScript ve görselleri.
- `server.js`: Express statik sunucusu ve `/health`, `/api/status` JSON uçları.
- `deploy/my-site.service`: açılışta başlatma ve çökme sonrası yeniden başlatma.
- `deploy/nginx/my-site.conf`: HTTP başlangıç ayarı.
- `deploy/nginx/my-site-https.conf`: sertifika alındıktan sonra HTTPS ayarı.
- `.github/workflows/deploy.yml`: main push → test → SSH → pull → install → restart → health.

## Yerelde çalıştırma

Node.js 24 ve npm kullanın. Proje klasöründe:

```bash
npm ci
npm test
npm start
```

`http://127.0.0.1:3000` adresini açın. Başka port için `PORT=3001 npm start`.

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/api/status
```

Örnek yanıt: `{"status":"ok","service":"my-site","uptime":12,"timestamp":"..."}`.
Sunucu yalnızca 127.0.0.1 üzerinde dinler; dışarıya Nginx üzerinden açılır.

## GitHub deposu

Bu klasörün **içeriğini depo köküne** koyun; başka bir deponun alt klasörüne
koyarsanız Actions dosyası otomatik bulunmaz. Eski portfolyo deposunun üzerine
yazmak yerine yeni bir GitHub deposu oluşturun. Aşağıdaki `YOUR_NEW_REPO`
yerini kendi yeni depo adınızla değiştirin:

```bash
git init -b main
git add .
git commit -m "Add portfolio with VPS deployment"
git remote add origin https://github.com/eminegozel/YOUR_NEW_REPO.git
git push -u origin main
```

İlk push öncesi sunucu ve secrets hazırlanmadıysa deploy işi başarısız olur;
kurulum tamamlanınca Actions sayfasından yeniden çalıştırabilirsiniz.

## Ubuntu VPS ilk kurulum

Aşağıdaki örnekler sistem genelinde `/usr/bin/node` ve `/usr/bin/npm` üzerinden
Node.js 24 kurulu olduğunu varsayar. Resmi Node.js dağıtım yöntemini kullanın;
`node --version`, `command -v node`, `command -v npm` ile doğrulayın.
NVM kurulumu systemd tarafından otomatik yüklenmez; farklı bir Node yolu
kullanıyorsanız servis dosyasını uyarlayın.

```bash
sudo apt update
sudo apt install -y nginx git curl certbot python3-certbot-nginx
sudo adduser --disabled-password --gecos "" deploy
sudo install -d -o deploy -g deploy /var/www/my-site
```

VPS üzerinde `deploy` hesabının SSH erişimini hazırlayın. GitHub Actions için
ayrı bir SSH anahtar çifti üretin, public kısmını VPS üzerindeki
`/home/deploy/.ssh/authorized_keys` dosyasına ekleyin. `.ssh` izinleri 700,
`authorized_keys` izinleri 600 olmalıdır. Private anahtarı depoya koymayın.

Depoyu VPS'e ilk defa çekin (URL'yi değiştirin):

```bash
sudo -u deploy git clone --branch main https://github.com/eminegozel/YOUR_NEW_REPO.git /var/www/my-site
sudo -u deploy sh -c 'cd /var/www/my-site && npm ci --omit=dev'
sudo cp /var/www/my-site/deploy/my-site.service /etc/systemd/system/my-site.service
sudo systemctl daemon-reload
sudo systemctl enable --now my-site
curl --fail http://127.0.0.1:3000/health
```

Özel GitHub deposu kullanıyorsanız VPS'teki `deploy` kullanıcısına ayrıca
GitHub için salt okunur deploy key tanımlayın. Actions → VPS anahtarı ile
VPS → GitHub anahtarı farklı amaçlara hizmet eder.

`sudo visudo -f /etc/sudoers.d/my-site` ile yalnızca yeniden başlatma yetkisi verin:

```sudoers
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart my-site
```

`systemctl` yolu farklıysa hem sudoers hem workflow içindeki yolu değiştirin.

## Nginx ve HTTPS

Alan adınızın DNS A kaydını VPS IP'sine yönlendirin. `www` kullanıyorsanız onun
kaydını da ekleyin. Her iki Nginx örneğinde `example.com` alanını değiştirin.
Sertifika yokken HTTPS dosyasını etkinleştirmeyin.

```bash
sudo cp /var/www/my-site/deploy/nginx/my-site.conf /etc/nginx/sites-available/my-site
sudo ln -s /etc/nginx/sites-available/my-site /etc/nginx/sites-enabled/my-site
sudo nginx -t
sudo systemctl reload nginx
```

Varsayılan Nginx sitesi alan adı eşleşmesini engelliyorsa onu devre dışı bırakın.
VPS sağlayıcısının ağ kurallarında 80/443 ve kullandığınız SSH portu açık olmalı.
UFW kullanıyorsanız SSH erişimini koruyarak `sudo ufw allow 'Nginx Full'` çalıştırın.
3000 portunu dışarıya açmanız gerekmez.

```bash
sudo certbot --nginx -d example.com -d www.example.com
sudo certbot renew --dry-run
```

Certbot HTTP ayarını HTTPS için düzenleyebilir. Alternatif olarak sertifika
oluşunca `my-site-https.conf` dosyasını `/etc/nginx/sites-available/my-site`
üzerine kopyalayın, `sudo nginx -t` ve reload çalıştırın. HTTPS örneğinde
80 HTTPS'e yönlenir, 443 Node.js 3000 portuna proxy yapar.

## GitHub Actions secrets

Yeni deponuzda Settings → Secrets and variables → Actions altında:

| Secret | Değer |
| --- | --- |
| `SSH_HOST` | VPS IP adresi veya alan adı (http/https öneki olmadan) |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Actions için oluşturduğunuz SSH private anahtarının tamamı |
| `SSH_KNOWN_HOSTS` | VPS'in doğrulanmış SSH host key satırı |

Sunucu kimliğini doğrulamak için ek `SSH_KNOWN_HOSTS` kullanılır. Kendi
bilgisayarınızdan `ssh-keyscan -H SUNUCU_IP` çıktısını alın; çıktının anahtarını
VPS sağlayıcısının konsolunda `/etc/ssh/ssh_host_ed25519_key.pub` ile doğrulayın,
sonra secret'a kaydedin. Workflow host doğrulamasını devre dışı bırakmaz.
Örnek SSH bağlantısı varsayılan 22 portunu kullanır.

Hazırlık bitince main'e push edin. Önce `npm ci` ve testler çalışır.
Başarılıysa VPS'te `/var/www/my-site` içinde `git pull --ff-only origin main`,
`npm install --omit=dev` ve `sudo systemctl restart my-site` çalışır.
Sağlık kontrolü yanıt vermezse iş başarısız görünür. Otomatik geri alma yoktur.
VPS checkout'u temiz ve main dalında olmalıdır. Sunucuda dosyaları elle
editlemek yerine değişiklikleri GitHub üzerinden gönderin.

## Hocaya göstermek için

```bash
curl -I https://example.com
curl https://example.com/api/status
sudo systemctl status my-site
sudo journalctl -u my-site -n 50 --no-pager
sudo nginx -t
```

Bir yazı değişikliğini main'e push edip Actions'ın başarılı çalışmasını ve
canlı sitedeki değişikliği gösterin. Sunucuyu yeniden başlattıktan sonra
`systemctl is-active my-site` ile açılışta otomatik çalışmayı doğrulayın.

## Kaynaklar

- Express: https://expressjs.com/en/starter/static-files.html
- Nginx proxy: https://nginx.org/en/docs/http/ngx_http_proxy_module.html
- GitHub Actions: https://docs.github.com/en/actions

Bu klasör VPS kurulumuna hazır kaynakları içerir. Gerçek VPS, DNS, TLS ve SSH
bilgileri olmadan uzak dağıtımın çalıştığı iddia edilmez.
