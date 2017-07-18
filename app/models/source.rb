class Source < ActiveRecord::Base
  has_many :series
  has_many :measurements

  def Source.get_or_new_dbedt(description, link = nil)
    Source.find_by(universe: 'DBEDT', description: description) ||
    (link && Source.find_by(universe: 'DBEDT', link: link)) ||
    Source.create(universe: 'DBEDT', description: description, link: link)
  end

  def Source.get_or_new_nta(description, link = nil)
    Source.find_by(universe: 'NTA', description: description) ||
    (link && Source.find_by(universe: 'NTA', link: link)) ||
    Source.create(universe: 'NTA', description: description, link: link)
  end

end
