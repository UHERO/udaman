# -*- mode: ruby -*-
# vi: set ft=ruby :

# requires the following plugins:
# vagrant plugin install vagrant-reload
# vagrant plugin install vagrant-vbguest

# provisioning scripts
$script = <<SCRIPT
echo "SELINUX=disabled" | sudo tee -a /etc/selinux/config
SCRIPT

Vagrant.configure('2') do |config|
  # For a complete reference, please see the online documentation at
  # https://docs.vagrantup.com.
  config.vm.synced_folder '.', '/vagrant', type: 'rsync', rsync__exclude: '.git/'

  # Every Vagrant development environment requires a box. You can search for
  # boxes at https://atlas.hashicorp.com/search.
  config.vm.box = 'centos/6'
  # workaround for issue with Vagrant 1.8.5 (https://github.com/mitchellh/vagrant/issues/7610)
  config.ssh.insert_key = false

  # provisioning steps
  config.vm.provision 'shell', inline: $script
  config.vm.provision :reload
  config.vm.provision 'shell', path: 'vagrant_support_script.txt', privileged: false

  # Forwarded port mapping for http
  config.vm.network 'forwarded_port', guest: 3000, host: 3000
  # Forwarded port mapping for rest-api
  config.vm.network 'forwarded_port', guest: 8080, host: 8080
  # Forwarded port mapping for debugging
  config.vm.network 'forwarded_port', guest: 1234, host: 11234, auto_correct: true

  config.vm.post_up_message = %Q|vagrant ssh\n
Then\n
cd /vagrant
rails s -b 0.0.0.0|
end
