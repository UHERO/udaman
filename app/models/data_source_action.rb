class DataSourceAction < ApplicationRecord
  belongs_to :series
  belongs_to :user
  belongs_to :data_source
end
