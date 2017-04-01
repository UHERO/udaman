class MeasurementSeries < ActiveRecord::Base
  belongs_to :measurement
  belongs_to :series
end
