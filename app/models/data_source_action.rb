class DataSourceAction < ActiveRecord::Base
  belongs_to :series
  belongs_to :users
  belongs_to :data_source
end
