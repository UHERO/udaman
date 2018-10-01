class MeasurementSeries < ApplicationRecord
  belongs_to :measurement
  belongs_to :series
end
