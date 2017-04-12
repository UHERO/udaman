class Unit < ActiveRecord::Base
  before_destroy :unlink_referring_objects

  def make_menu_item
    ('%s / %s' % [short_label || '-', long_label || '-']).html_safe
  end

  private
  def unlink_referring_objects
    Series.where(:unit_id => self.id).each {|s| s.update(:unit_id => nil) }
    Measurement.where(:unit_id => self.id).each {|m| m.update(:unit_id => nil) }
  end

end
