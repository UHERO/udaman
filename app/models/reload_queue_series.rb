class ReloadQueueSeries < ApplicationRecord
  belongs_to :reload_queue
  belongs_to :series
end
