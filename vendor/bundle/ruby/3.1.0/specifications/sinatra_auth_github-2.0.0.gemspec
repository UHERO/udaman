# -*- encoding: utf-8 -*-
# stub: sinatra_auth_github 2.0.0 ruby lib

Gem::Specification.new do |s|
  s.name = "sinatra_auth_github".freeze
  s.version = "2.0.0"

  s.required_rubygems_version = Gem::Requirement.new(">= 0".freeze) if s.respond_to? :required_rubygems_version=
  s.require_paths = ["lib".freeze]
  s.authors = ["Corey Donohoe".freeze]
  s.date = "2017-09-08"
  s.description = "A sinatra extension for easy oauth integration with github".freeze
  s.email = ["atmos@atmos.org".freeze]
  s.homepage = "http://github.com/atmos/sinatra_auth_github".freeze
  s.licenses = ["MIT".freeze]
  s.rubygems_version = "3.3.27".freeze
  s.summary = "A sinatra extension for easy oauth integration with github".freeze

  s.installed_by_version = "3.3.27" if s.respond_to? :installed_by_version

  if s.respond_to? :specification_version then
    s.specification_version = 4
  end

  if s.respond_to? :add_runtime_dependency then
    s.add_runtime_dependency(%q<sinatra>.freeze, ["~> 2.0"])
    s.add_runtime_dependency(%q<warden-github>.freeze, ["~> 1.3"])
    s.add_development_dependency(%q<rake>.freeze, [">= 0"])
    s.add_development_dependency(%q<rspec>.freeze, [">= 0"])
    s.add_development_dependency(%q<shotgun>.freeze, [">= 0"])
    s.add_development_dependency(%q<randexp>.freeze, [">= 0"])
    s.add_development_dependency(%q<rack-test>.freeze, [">= 0"])
  else
    s.add_dependency(%q<sinatra>.freeze, ["~> 2.0"])
    s.add_dependency(%q<warden-github>.freeze, ["~> 1.3"])
    s.add_dependency(%q<rake>.freeze, [">= 0"])
    s.add_dependency(%q<rspec>.freeze, [">= 0"])
    s.add_dependency(%q<shotgun>.freeze, [">= 0"])
    s.add_dependency(%q<randexp>.freeze, [">= 0"])
    s.add_dependency(%q<rack-test>.freeze, [">= 0"])
  end
end
