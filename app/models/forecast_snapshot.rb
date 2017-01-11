class ForecastSnapshot < ActiveRecord::Base
  has_many :tsd_files

  # Get series name from series mnemonic
  def retrieve_name(prefix)
    m = Measurement.find_by(prefix: prefix.chomp('NS'))
    if m.nil?
      return ''
    end
    m.data_portal_name
  end

  def retrieve_units(prefix)
    m = Measurement.find_by(prefix: prefix.chomp('NS'))
    if m.nil? || m.units_label_short.nil? || m.units_label_short == ''
      return 'Values'
    end
    m.units_label_short
  end

end
