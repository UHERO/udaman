module UnitsHelper
  def num_affected(unit)
    num = Series.where(:unit_id => unit.id).count + Measurement.where(:unit_id => unit.id).count
    '%d series and measurements will be affected' % num
  end
end
