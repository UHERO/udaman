class PublicDataPoint < ActiveRecord::Base
  self.primary_keys = :series_id, :date
  belongs_to :series
end
