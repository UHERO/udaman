# Server Config Copies
These are for reference only, not guaranteed to be up to date.

## NGINX
Ruby on Rails version

/etc/nginx/sites-available/stage-udaman.uhero.hawaii.edu

```nginx
server {
    server_name stage-udaman.uhero.hawaii.edu;

    root /home/uhero/udaman/public;

    # Load default server configuration
    include /etc/nginx/default.d/*.conf;

    location / {
        # Restrict access to internal IPs
        # include /etc/nginx/snippets/internal-ips.conf;

        add_header X-Debug-Message "Udaman";

        proxy_pass http://127.0.0.1:3000;
        include /etc/nginx/snippets/proxy-params.conf;

        proxy_set_header X-Forwarded-Ssl on;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_read_timeout 10m;
        proxy_buffering off;
        client_max_body_size 50M;
    }
    # Custom error pages
    error_page 403 /403.html;
        location = /403.html {
            internal;
    }

    error_page 404 /404.html;
    location = /404.html {
        internal;
    }

    error_page 500 502 503 504 /500.html;
    location = /500.html {
        internal;
    }

    listen 443 ssl; # managed by Certbot
    # certbot config here...
}

server {
    if ($host = stage-udaman.uhero.hawaii.edu) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;

    server_name stage-udaman.uhero.hawaii.edu;
    return 404; # managed by Certbot
}

```


## Systemd Unit File
Ruby on Rails version

/etc/systemd/system/udaman.service
```bash
[Unit]
Description=Udaman Rails App (Passenger Standalone)
After=network.target
Wants=network.target

[Service]
Type=forking
User=uhero

# App root
WorkingDirectory=/home/uhero/udaman

# Environment
Environment=PASSENGER_INSTANCE_REGISTRY_DIR=/tmp
Environment=RAILS_ENV=production
EnvironmentFile=/etc/secrets/udaman.env

# Passenger executable (adjust ruby path if needed)
ExecStart=/bin/bash -lc 'cd /home/uhero/udaman && bundle exec passenger start -p 3000 -d -e development'
ExecStop=/bin/bash -lc 'cd /home/uhero/udaman && bundle exec passenger stop -p 3000'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```