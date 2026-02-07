# -*- encoding: utf-8 -*-
# stub: rspec-sidekiq 3.1.0 ruby lib

Gem::Specification.new do |s|
  s.name = "rspec-sidekiq".freeze
  s.version = "3.1.0"

  s.required_rubygems_version = Gem::Requirement.new(">= 0".freeze) if s.respond_to? :required_rubygems_version=
  s.require_paths = ["lib".freeze]
  s.authors = ["Phil Ostler".freeze]
  s.date = "2020-06-21"
  s.description = "Simple testing of Sidekiq jobs via a collection of matchers and helpers".freeze
  s.email = "github@philostler.com".freeze
  s.homepage = "http://github.com/philostler/rspec-sidekiq".freeze
  s.licenses = ["MIT".freeze]
  s.rubygems_version = "3.3.27".freeze
  s.summary = "RSpec for Sidekiq".freeze

  s.installed_by_version = "3.3.27" if s.respond_to? :installed_by_version

  if s.respond_to? :specification_version then
    s.specification_version = 4
  end

  if s.respond_to? :add_runtime_dependency then
    s.add_runtime_dependency(%q<rspec-core>.freeze, [">= 3.0.0", "~> 3.0"])
    s.add_runtime_dependency(%q<sidekiq>.freeze, [">= 2.4.0"])
    s.add_development_dependency(%q<rspec>.freeze, [">= 0"])
    s.add_development_dependency(%q<coveralls>.freeze, [">= 0"])
    s.add_development_dependency(%q<fuubar>.freeze, [">= 0"])
    s.add_development_dependency(%q<activejob>.freeze, [">= 0"])
    s.add_development_dependency(%q<actionmailer>.freeze, [">= 0"])
    s.add_development_dependency(%q<activerecord>.freeze, [">= 0"])
    s.add_development_dependency(%q<activemodel>.freeze, [">= 0"])
    s.add_development_dependency(%q<activesupport>.freeze, [">= 0"])
  else
    s.add_dependency(%q<rspec-core>.freeze, [">= 3.0.0", "~> 3.0"])
    s.add_dependency(%q<sidekiq>.freeze, [">= 2.4.0"])
    s.add_dependency(%q<rspec>.freeze, [">= 0"])
    s.add_dependency(%q<coveralls>.freeze, [">= 0"])
    s.add_dependency(%q<fuubar>.freeze, [">= 0"])
    s.add_dependency(%q<activejob>.freeze, [">= 0"])
    s.add_dependency(%q<actionmailer>.freeze, [">= 0"])
    s.add_dependency(%q<activerecord>.freeze, [">= 0"])
    s.add_dependency(%q<activemodel>.freeze, [">= 0"])
    s.add_dependency(%q<activesupport>.freeze, [">= 0"])
  end
end
