[![Build Status](https://travis-ci.org/UHERO/udaman.svg?branch=master)](https://travis-ci.org/UHERO/udaman)
Udaman: UHERO Data Manager
======

Udaman is [UHERO](https://uhero.hawaii.edu)'s data management system.

To set up your development environment,

1. [Install Vagrant](https://www.vagrantup.com/downloads.html).
2. [Install Virtual Box](https://www.virtualbox.org/wiki/Downloads).
3. Clone this project.
4. Install the following Vagrant plugins:
    1. `vagrant plugin install vagrant-reload`
    2. `vagrant plugin install vagrant-vbguest`
5. `vagrant up` in the porject directory.
6. `vagrant ssh` to log into the Udaman VM.
7. In the Udaman VM, run the following commands to start the server, which you can access at localhost:3000:

    ```
    cd /vagrant
    rails s -b 0.0.0.0
    ```

### Add a user
From the Udaman application folder, open the rails console:
```bash
rails console
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
rails s -b 0.0.0.0
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
