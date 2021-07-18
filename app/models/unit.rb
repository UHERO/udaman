class Unit < ApplicationRecord
  include Cleaning
  has_many :series
  has_many :measurements
  before_destroy :last_rites

  def to_s
    ('%s (%s)' % [long_label, short_label]).html_safe
  end

  def Unit.get_or_new(label, universe = 'UHERO')
    Unit.find_by(universe: universe, short_label: label) ||
     Unit.create(universe: universe, short_label: label, long_label: label)
  end

private

  def last_rites
    unless Series.where(unit_id: id).empty?
      raise "Cannot destroy unit #{self} (id=#{id}) because a Series is using it"
    end
    unless Measurement.where(unit_id: id).empty?
      raise "Cannot destroy unit #{self} (id=#{id}) because a Measurement is using it"
    end
    Rails.logger.info { "DESTROY unit #{self}: completed" }
  end

end
