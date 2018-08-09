class Source < ActiveRecord::Base
  include Validators

  has_many :series
  has_many :measurements
  validates_each :link do |record, attr, value|
    unless valid_url(value)
      record.errors.add(attr, 'not a valid URL')
    end
  end

  def Source.get_or_new(description, link = nil, universe = 'UHERO')
    Source.find_by(universe: universe, description: description) ||
    (link && Source.find_by(universe: universe, link: link)) ||
    Source.create(universe: universe, description: description, link: link)
  end

end
