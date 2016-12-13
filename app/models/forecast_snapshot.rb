class ForecastSnapshot < ActiveRecord::Base
  has_many :tsd_files

end
