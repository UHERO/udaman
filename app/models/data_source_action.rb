class DataSourceAction < ActiveRecord::Base
  belongs_to :series
  has_one :users
  has_one :data_sources
end
