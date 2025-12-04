 # UDAMAN - UHERO Data Manager

## Tech Stack
- Ruby on Rails v 6.0.1
- Ruby v 3.1.4
- Database: MariaDB v10 runs on "uhero12" server
- Sidekiq job queue runs runs on "uhero13" server


## Directory Map
Rails follows MVC pattern:
├── app
│   ├── assets
│   ├── controllers
│   ├── helpers
│   ├── jobs
│   ├── lib
│   ├── mailers
│   ├── models
│   ├── views
│   └── workers
├── bin
│   ├── bundle
│   ├── rails
│   ├── rake
│   ├── setup
│   ├── update
│   └── yarnDISABLE
├── claude.md
├── config
│   ├── application.rb
│   ├── boot.rb
│   ├── cable.yml
│   ├── cucumber.yml
│   ├── database.yml
│   ├── environment.rb
│   ├── environments
│   ├── initializers
│   ├── locales
│   ├── routes.rb
│   ├── schedule.rb
│   ├── secrets.yml
│   ├── sidekiq.yml
│   └── storage.yml
├── config.ru
├── db
│   ├── migrate
│   ├── schema.rb
│   └── seeds.rb
├── doc
│   └── README_FOR_APP
├── Gemfile
├── Gemfile.lock
├── lib
│   └── tasks
├── log
│   ├── development.log
├── public
│   ├── 403.html
│   ├── 404.html
│   ├── 422.html
│   ├── 500.html
│   ├── favicon.ico
│   ├── robots.txt
│   ├── system_summary.csv
│   └── testjs.html
├── Rakefile
├── README.md
├── script
│   ├── datapor.rb
│   ├── dis_cma.rb
│   ├── fix.rb
│   ├── ld-jul.rb
│   ├── rails
│   ├── rasterize_web.js
│   ├── rasterize.js
│   ├── temp.rb
│   ├── test.rb
│   └── tmp_err.rb
├── sidekiq_config.ru


## Running Locally
```bash
bundle install
rails s
```

## Domain Concepts
- UDAMAN is a time series data management application.
- Some bugs persist due to a recent migraton from rails 5 wildcard routing to now using routes.rb with explicit routes.
- Some bugs may persist due to changes from migrating from rails 5 to rails 6.0 then 6.1. 
- The app ingests data from a range of sources: api, file downloads, and files made available on the server.
- The Series model is the dominant model for the app, XSeries is closely related, it contains additional metdata related to Series.