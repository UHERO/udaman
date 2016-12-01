# -*- mode: ruby -*-
# vi: set ft=ruby :

# requires the following plugins:
# vagrant plugin install vagrant-reload
# vagrant plugin install vagrant-vbguest

# provisioning scripts
$script1 = <<SCRIPT
echo "SELINUX=disabled" | sudo tee -a /etc/selinux/config
SCRIPT

$script2 = <<SCRIPT
sudo yum install -y epel-release yum-utils
sudo yum-config-manager --enable epel
sudo yum install -y pygpgme curl
sudo curl --fail -sSLo /etc/yum.repos.d/passenger.repo https://oss-binaries.phusionpassenger.com/yum/definitions/el-passenger.repo
sudo yum install -y mod_passenger
sudo yum install -y http-devel
wget http://dev.mysql.com/get/mysql57-community-release-el6-9.noarch.rpm
sudo yum localinstall -y mysql57-community-release-el6-9.noarch.rpm
sudo yum install -y mysql-community-server
sudo yum install -y mysql-devel
curl --silent --location https://rpm.nodesource.com/setup_6.x | bash -
sudo yum install -y nodejs
sudo yum install -y gcc-c++ make
sudo yum install -y libcurl-devel

sudo service httpd restart
gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3
curl -L get.rvm.io | bash -s stable
source /etc/profile.d/rvm.sh
rvm group add rvm "vagrant"
cd /vagrant
rvm install ruby-2.3.0
gem install bundler
bundle install
service mysqld start
export DB_PASSWORD=`sudo grep 'temporary password' /var/log/mysqld.log | awk 'NF>1{print $NF}'`
echo 'ALTER USER "root"@"localhost" IDENTIFIED BY "MyNewPass4!";' | sed "s/\"/'/g" > changepwd.txt
mysql -uroot -p$DB_PASSWORD --connect-expired-password < changepwd.txt
export DB_PASSWORD='MyNewPass4!'
rake db:setup
SCRIPT

Vagrant.configure("2") do |config|
  # For a complete reference, please see the online documentation at
  # https://docs.vagrantup.com.

  # Every Vagrant development environment requires a box. You can search for
  # boxes at https://atlas.hashicorp.com/search.
  config.vm.box = "centos/6"
  # workaround for issue with Vagrant 1.8.5 (https://github.com/mitchellh/vagrant/issues/7610)
  config.ssh.insert_key = false

  # provisioning steps
  config.vm.provision "shell", inline: $script1
  config.vm.provision :reload
  config.vm.provision "shell", inline: $script2

  # Create a forwarded port mapping which allows access to a specific port
  config.vm.network "forwarded_port", guest: 3000, host: 3000
  config.vm.network "forwarded_port", guest: 3306, host: 3316

  config.vm.post_up_message = %Q|Set new MySQL password: http://dev.mysql.com/doc/refman/5.7/en/linux-installation-yum-repo.html.\n
Then export the new password as DB_PASSWORD.\n
Then run bundle exec rake db:setup|
end
