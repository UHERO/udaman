Udaman: UHERO Data Manager
======

Udaman is [UHERO](http://uhero.hawaii.edu)'s data management system. Udaman is a Ruby on Rails applciation, and will therefore require Ruby to by installed. We use [RVM](https://rvm.io/) to manage our Ruby versions. Udaman is currently running on Ruby version ruby-1.9.2.

We encourage you to clone this project and take it for a spin. Fork us and contribute to the project through pull requests.

The following instructions assume you are using OS X.

Setting Up Your Development Environment
----

### Clone the project
```bash
git clone https://github.com/UHERO/udaman.git
```

### Change directories into the `udaman` folder:
```bash
cd udaman
```

### Install the required gems
```bash
bundle install
```

### Start MySQL (if it's not already running)
```bash
mysqld
```
If this didn't work, make sure you have MySQL and Homebrew installed (try [this tutorial](http://benjsicam.me/blog/how-to-install-mysql-on-mac-os-x-using-homebrew-tutorial/)).

### Import the MySQL schema 
```bash
mysql -u root -p uhero_db_dev < schema.sql
```
Replace `root` with your MySQL username.

### Add a user
From the udaman application folder, open the rails console:
```bash
rails console
```

Add a user:
```ruby
User.create!(:email => "your@email.com", :password => "secret", :password_confirmation => "secret")
```
Replace `your@email.com` and `secret` with your desired username and password.

Quit the rails console
```ruby
quit
```

### Load the data
This tasks will take a long time to run completely (approximately 10 hours). You can interrupt the task by closing your terminal window if you prefer to only load some of the data. From the console, run the following rake task:
```bash
rake rebuild
```


### Take Udaman for a spin
Start the rails server in the console
```bash
rails server
```

In another terminal window enter the rails console in the project folder (`rails console`). And find the name of a series with data in it using the following command:
```ruby
Series.all.each {|s| dps = s.current_data_points.count; puts "#{s.name}, #{dps}" if dps > 0};0
```
This command will spit out a list of series mnemonics with their number of current data points.

If you don't have any series with a decent number of data points (i.e., more than 50), go ahead and run `rake rebuild` a little longer this time to download some more series.

Navigate to Udaman in your browser. The default location is [http://localhost:3000/](http://localhost:3000/).

Type the name of the series (i.e., the series mnemonic) you've chosen into the search bar in the top right of Udaman. For example, "BRENT@US.M"

Click the **Analyze** link in the under the series header to the left to see a graphical display of this series.

Contributing to UDAMAN
---
Fork this repo and submit a pull request if you would like to contribute to Udaman.
