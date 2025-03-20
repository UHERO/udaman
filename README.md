[![Build Status](https://travis-ci.org/UHERO/udaman.svg?branch=master)](https://travis-ci.org/UHERO/udaman)
Udaman: UHERO Data Manager
======

Udaman is [UHERO](https://uhero.hawaii.edu)'s data management system.

# Setup for Local Development

<br>

## 1. Get Database Data
### Option A: Clone Test DB

### Notes
- Do this after hours, when no one is using udaman. It can take several minutes, during which time you may slow down or interfere with other network traffic.
- Guide assumes you've set up an alias for each server. If not, enter the full server name rather than "uhero12".
- Guide assumes you have a user account with ssh access to uhero12. If not, check with lead dev.
- Guide assumes you've installed mysql on your computer

    ### As uhero user on uhero12
    Run this from zsh or bash, not from inside mysql.
    ```bash
    $ mysqldump -u uhero -p test > dump.sql
    ```
    ### As yourself on your computer
    Move file from uhero12 to udaman's root directory
    ```bash
    $ scp username@uhero12:/path/to/dump.sql /path/to/local/udaman/dir
    ```
    Load copied data file into test db on your computer
    ```bash
    $ mysql -u uhero -p test < ./dump.sql
    ```

    Voila! Doublecheck your database.yml file to confirm your databse name, and access info.

### Option B: request copy of of development db
- If there is a lead dev, ask them to send you a copy to use locally. If you are the lead dev, rtfm.

### Option C: Connect to "test" database on uhero12
- This will be the quickest option to get up and running. Under no circumstances should you connect to the prod database named "uhero_dev_db". 
<br>
<br>
<br>

## 2. Initiate Rails App
### Notes
- Guide assumes you've installed Ruby version listed in `.ruby-version` and Rails version listed in `Gemfile`. 
- Guide assumes you've already cloned the Udaman repo from GitHub.

### Install Gems
```bash
$ bundle install
# if you need to remove all gems and start over:
# gem uninstall -aIx
```

<br>
<br>
<br>

## 3. Add a User Acct
From the Udaman application folder, open the rails console:
```bash
$ rails console
```

Add a user:
```ruby
User.create!(email: "your@email.com", role: <as appropriate>, password: "secret", password_confirmation: "secret")
```
Replace `your@email.com` and `secret` with your desired username and password.

Quit the rails console
```ruby
quit
```

### Take Udaman for a spin
Start the rails server in the console
```bash
$ rails s -b 0.0.0.0
```

In another terminal window enter the rails console in the project folder (`rails console`). And find the name of a series with data in it using the following command:
```ruby
Series.all.each {|s| dps = s.current_data_points.count; puts "#{s.name}, #{dps}" if dps > 0};0
```
This command will spit out a list of series mnemonics with their number of current data points.

Navigate to Udaman in your browser. The default location is [http://localhost:3000/](http://localhost:3000/).

Type the name of the series (i.e., the series mnemonic) you've chosen into the search bar in the top right of Udaman. For example, "BRENT@US.M"

Click the **Analyze** link in the under the series header to the left to see a graphical display of this series.

Contributing to Udaman
---
Fork this repo and submit a pull request if you would like to contribute to Udaman.
