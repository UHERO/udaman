class ReloadJobSeries < ApplicationRecord
  belongs_to :reload_job
  belongs_to :series
end
