class SeriesSlaveLog < ActiveRecord::Base
  self.primary_key = :batch_id, :series_id
end
