class Unit < ApplicationRecord
  include Cleaning
  has_many :series
  has_many :measurements
  before_destroy :unlink_referring_objects

  def to_s
    ('%s (%s)' % [long_label, short_label]).html_safe
  end

  def Unit.get_or_new(label, universe = 'UHERO')
    Unit.find_by(universe: universe, short_label: label) ||
     Unit.create(universe: universe, short_label: label, long_label: label)
  end

private
  def unlink_referring_objects
    Series.where(unit_id: self.id).update_all(unit_id: nil)
    Measurement.where(unit_id: self.id).update_all(unit_id: nil)
  end

end
