class Source < ActiveRecord::Base
  has_many :series
  has_many :measurements

  def Source.get_or_new(description, link = nil, universe = 'UHERO')
    Source.find_by(universe: universe, description: description) ||
    (link && Source.find_by(universe: universe, link: link)) ||
    Source.create(universe: universe, description: description, link: link)
  end

end
