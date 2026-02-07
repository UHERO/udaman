# -*- encoding: utf-8 -*-
# stub: warden-github 1.3.2 ruby lib

Gem::Specification.new do |s|
  s.name = "warden-github".freeze
  s.version = "1.3.2"

  s.required_rubygems_version = Gem::Requirement.new(">= 0".freeze) if s.respond_to? :required_rubygems_version=
  s.require_paths = ["lib".freeze]
  s.authors = ["Corey Donohoe".freeze]
  s.date = "2017-05-15"
  s.description = "A warden strategy for easy oauth integration with github".freeze
  s.email = ["atmos@atmos.org".freeze]
  s.homepage = "http://github.com/atmos/warden-github".freeze
  s.licenses = ["MIT".freeze]
  s.rubygems_version = "3.3.27".freeze
  s.summary = "A warden strategy for easy oauth integration with github".freeze

  s.installed_by_version = "3.3.27" if s.respond_to? :installed_by_version

  if s.respond_to? :specification_version then
    s.specification_version = 4
  end

  if s.respond_to? :add_runtime_dependency then
    s.add_runtime_dependency(%q<warden>.freeze, ["> 1.0"])
    s.add_runtime_dependency(%q<octokit>.freeze, ["> 2.1.0"])
    s.add_runtime_dependency(%q<activesupport>.freeze, ["> 3.0"])
    s.add_development_dependency(%q<rack>.freeze, ["~> 1.4.1"])
    s.add_development_dependency(%q<rake>.freeze, [">= 0"])
    s.add_development_dependency(%q<rspec>.freeze, ["~> 3.6"])
    s.add_development_dependency(%q<simplecov>.freeze, [">= 0"])
    s.add_development_dependency(%q<webmock>.freeze, ["~> 1.9"])
    s.add_development_dependency(%q<sinatra>.freeze, [">= 0"])
    s.add_development_dependency(%q<shotgun>.freeze, [">= 0"])
    s.add_development_dependency(%q<addressable>.freeze, ["> 2.2.0"])
    s.add_development_dependency(%q<rack-test>.freeze, ["~> 0.5.3"])
    s.add_development_dependency(%q<yajl-ruby>.freeze, [">= 0"])
  else
    s.add_dependency(%q<warden>.freeze, ["> 1.0"])
    s.add_dependency(%q<octokit>.freeze, ["> 2.1.0"])
    s.add_dependency(%q<activesupport>.freeze, ["> 3.0"])
    s.add_dependency(%q<rack>.freeze, ["~> 1.4.1"])
    s.add_dependency(%q<rake>.freeze, [">= 0"])
    s.add_dependency(%q<rspec>.freeze, ["~> 3.6"])
    s.add_dependency(%q<simplecov>.freeze, [">= 0"])
    s.add_dependency(%q<webmock>.freeze, ["~> 1.9"])
    s.add_dependency(%q<sinatra>.freeze, [">= 0"])
    s.add_dependency(%q<shotgun>.freeze, [">= 0"])
    s.add_dependency(%q<addressable>.freeze, ["> 2.2.0"])
    s.add_dependency(%q<rack-test>.freeze, ["~> 0.5.3"])
    s.add_dependency(%q<yajl-ruby>.freeze, [">= 0"])
  end
end
