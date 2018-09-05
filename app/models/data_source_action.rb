class DataSourceAction < ActiveRecord::Base
  belongs_to :series
  belongs_to :user
  belongs_to :data_source
end
