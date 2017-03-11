class Source < ActiveRecord::Base
  has_many :series
  has_many :measurements

  def Source.get_or_new_dbedt(description)
    Source.find_by(source_type: 'DBEDT', description: description) ||
    Source.create(source_type: 'DBEDT', description: description)
  end

end
