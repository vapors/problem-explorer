# DirectAdmin VPS deployment

**Recommended: run Docker Compose on the VPS and let DirectAdmin's Nginx/Apache handle TLS and the domain.** Requirements: SSH, sudo/root, Docker Engine + Compose plugin, a spare local port, and a configured domain/subdomain. Shared hosting without Docker privileges is not sufficient for this method.

1. Create a subdomain, e.g. `atlas.example.com`, in DirectAdmin. Enable its HTTPS certificate (Let's Encrypt).
2. Upload/unzip the source outside `public_html`, e.g. `/opt/longevity-atlas`. Copy `.env.example` to `.env`, set a *strong* NEO4J_PASSWORD and the API key. `chmod 600 .env`.
3. On the VPS: `docker compose up -d --build`. The application binds to `127.0.0.1:8080` only. Neo4j is also loopback-only.
4. Configure the subdomain's reverse proxy to `http://127.0.0.1:8080` using **DirectAdmin's supported custom HTTPD/Nginx customization**. Do not directly edit generated vhost config files: DirectAdmin may overwrite them. The exact customization mechanism depends on your web-server stack and DirectAdmin configuration.
5. Confirm HTTPS at the public domain and check `https://atlas.example.com/api/health`. Proxy requests for both `/` and `/api/` to the same local web container.
6. Restrict the website using HTTP authentication, VPN, or another access gateway **before exposing it**. **v0.1 has no user authentication or multi-tenant security.** Do not publish the API anonymously.
7. For production, back up the `neo4j_data` volume regularly, review OpenAI cost/usage, use firewall restrictions, and set up monitoring and resource limits.

If your DirectAdmin deployment uses an existing Nginx reverse proxy, an illustrative block for the custom upstream is:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

**Apply via the supported DirectAdmin custom configuration interface, not by overwriting server-managed files.** Verify that your configuration doesn't conflict with other existing location blocks.

Do not expose ports `7474`/`7687` publicly or store the API key in JavaScript or `public_html`.
