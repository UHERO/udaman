class Source < ActiveRecord::Base
  include Validators

  has_many :series
  has_many :measurements
  validate :link_is_valid

  def Source.get_or_new(description, link = nil, universe = 'UHERO')
    Source.find_by(universe: universe, description: description) ||
    (link && Source.find_by(universe: universe, link: link)) ||
    Source.create(universe: universe, description: description, link: link)
  end

private
  def link_is_valid
    link.blank? || valid_url(link) || errors.add(:link, 'is not a valid URL')
  end
end
