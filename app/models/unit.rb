class Unit < ActiveRecord::Base
  has_many :series
  has_many :measurements
  before_destroy :unlink_referring_objects

  def to_s
    ('%s (%s)' % [long_label, short_label]).html_safe
  end

  def Unit.get_or_new_nta(label)
    Unit.find_by(universe: 'NTA', short_label: label) ||
     Unit.create(universe: 'NTA', short_label: label, long_label: label)
  end

  private
  def unlink_referring_objects
    Series.where(:unit_id => self.id).update_all(:unit_id => nil)
    Measurement.where(:unit_id => self.id).update_all(:unit_id => nil)
  end

end
