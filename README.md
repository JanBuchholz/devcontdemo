# Health service

This project runs a minimal Express service and stores a health-check record in
MongoDB every 10 minutes. It also records one check immediately after startup.

## Run with Docker Compose

```sh
docker compose up --build
```

The service is available at <http://localhost:3000/health>. Its only endpoint
returns `{"status":"ok"}`. MongoDB 4.4 stores check records in the `dcd`
database and `meldungen` collection; the `mongo_data` volume preserves them.

Each document includes `checkedAt`, `healthy`, and either the HTTP `statusCode`
and `response`, or an `error` when the health probe cannot reach the endpoint.
MongoDB is available to the application on the Compose network and is not
published to the host.

## Run locally

Start MongoDB with Compose and run the service on the host:

```sh
docker compose up -d mongo
MONGODB_URI=mongodb://localhost:27017 npm start
```

`MONGODB_URI`, `PORT`, and `HEALTHCHECK_URL` can be set in the environment (or
in a Compose `.env` file) to override the defaults.

## GitHub Codespaces

Open the repository in a Codespace and run **Codespaces: Rebuild Container** (or
create a new Codespace after changing the devcontainer files). The devcontainer
explicitly starts both the `app` and `mongo` Compose services, waits for MongoDB
to pass its health check before starting the app, installs npm dependencies,
and forwards port 3000.

In the Codespace terminal, `docker compose ps` should show both services as
running; `docker compose logs mongo` shows MongoDB startup output.
