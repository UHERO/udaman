class Unit < ActiveRecord::Base
  before_destroy :unlink_referring_objects

private
  def unlink_referring_objects
    Series.where(:unit_id => self.id).each {|s| s.update(:unit_id => nil) }
    Measurement.where(:unit_id => self.id).each {|m| m.update(:unit_id => nil) }
  end

end
