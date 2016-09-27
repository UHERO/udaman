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
sudo yum install -y mysql-server
sudo yum-config-manager --enable epel
sudo yum install -y pygpgme curl
sudo curl --fail -sSLo /etc/yum.repos.d/passenger.repo https://oss-binaries.phusionpassenger.com/yum/definitions/el-passenger.repo
sudo yum install -y mod_passenger
sudo yum install -y http-devel
sudo yum install -y mysql-devel
sudo yum install -y nodejs 
sudo yum install -y libcurl-devel

sudo service httpd restart
gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3
curl -L get.rvm.io | bash -s stable
source /etc/profile.d/rvm.sh
rvm group add rvm "vagrant"
cd /vagrant
rvm install ruby-2.3.0
gem install bundle
bundle install
service mysqld start
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
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:3000" will access port 80 on the guest machine.
  config.vm.network "forwarded_port", guest: 3000, host: 3000

  # Share an additional folder to the guest VM. The first argument is
  # the path on the host to the actual folder. The second argument is
  # the path on the guest to mount the folder. And the optional third
  # argument is a set of non-required options.
  # config.vm.synced_folder "../data", "/vagrant_data"
end
