require 'spec_helper'

describe DataPoint do
  before(:each) do
    @s = Series.create name: 'FOOTEST@HI.Q'
    @ds1_80 = DataSource.create priority: 80
    @ds2_80 = DataSource.create priority: 80
    @ds2_70 = DataSource.create priority: 70
    @dp = DataPoint.create(date: '2011-03-01',
                           value: 100.0,
                           series_id: @s.id,
                           data_source_id: @ds1_80.id,
                           current: true)
    ## Shove anything other than zero into the unused :id column as a way
    ## to check dp object identity that doesn't depend on the clock
    @arbitrary_id = 999
    @dp.write_attribute :id, @arbitrary_id
  end

  it 'should NOT change dp if value and source_id are unchanged' do
    newdp = @dp.upd(100, @ds1_80)
    cur_dps = @s.current_data_points
    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.read_attribute :id).to eq(@arbitrary_id), "current dp is different from original (#{cur_dps.first.read_attribute :id})"
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'orig dp value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'orig dp source has changed in place'
  end

  it 'should update a dp data source if source is different, source.priority >= current' do
    newdp = @dp.upd(100, @ds2_80)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.read_attribute :id).not_to eq(@arbitrary_id), 'a new dp was not created'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(@dp.current).to eq(false), 'old dp still current'
    expect(newdp.value_equal_to? dp.value).to eq(true), 'dp values are not equal'
    expect(newdp.data_source_id).to eq(@ds2_80.id), 'new dp does not have new source'
  end

  it 'should NOT update a dp data source if source is different, source.priority < current' do
    newdp = @dp.upd(100, @ds2_70)
    cur_dps = @s.current_data_points

    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.read_attribute :id).to eq(@arbitrary_id), 'current dp is different from original'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'orig dp value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'orig dp source has changed in place'
  end

  it 'should update a dp value if value is different, source.priority >= current' do
    newdp = @dp.upd(200, @ds2_80)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.read_attribute :id).not_to eq(@arbitrary_id), 'a new dp was not created'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(@dp.current).to eq(false), 'old dp still set to current'
    expect(newdp.value_equal_to? @dp.value).to eq(false), 'new and old dp values are equal'
    expect(newdp.data_source_id).to eq(@ds2_80.id), 'new dp doesnt have the new source'
  end

  it 'should NOT update a dp value if value is different, source.priority < current' do
    newdp = @dp.upd(200, @ds2_70)
    cur_dps = @s.current_data_points

    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.read_attribute :id).to eq(@arbitrary_id), 'current dp is different from original'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'orig dp value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'orig dp source has changed in place'
  end

  #########################################################################################################

  ## what about if there is an old dp with the correct properties, but lower priority? should not be restored
  it 'should restore previously current dp, when updated to its same properties' do
    dp1 = @dp.upd(200, @ds2_80)
    ## dp1 should now be current, as tested above
    newdp = dp1.upd(@dp.value, @dp.data_source)
    ## now @dp should be restored to current, and newdp should == @dp

    expect(@s.current_data_points.count).to eq(1), 'not exactly one current dp'
    expect(@s.data_points.count).to eq(2), 'not exactly two dps for this series'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.read_attribute :id).to eq(@arbitrary_id), 'a new dp was created rather than an old one restored'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(dp1.current).to eq(false), 'previous current dp still set to current'
    expect(newdp.value_equal_to? @dp.value).to eq(true), 'orig dp value has changed in place'
    expect(newdp.data_source_id).to eq(@dp.data_source_id), 'orig dp source has changed in place'
  end

  xit 'should restore correct dp next-in-line by updated_at time when current is deleted, part I' do
    sleep 1
    dp200 = @dp.upd(200, @ds1_80)
    sleep 1
    dp500 = dp200.upd(500, @ds1_80)
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? dp500.value).to eq(true), 'current dp is not dp=500'
    expect(dp500.current).to eq(true), 'new dp not set to current'
    expect(@s.data_points.count).to eq(3), 'not exactly three dps in this series'

    dp500.delete
    cdp = @s.current_data_points

    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? dp200.value).to eq(true), 'current dp is not dp=200'
    expect(dp200.current).to eq(true), 'dp=200 not set to current'
    expect(@s.data_points.count).to eq(2), 'not exactly two dps for this series'
  end

  xit 'should restore correct dp next-in-line by updated_at time when current is deleted, part II' do
    sleep 1
    dp200 = @dp.upd(200, @ds1_80)
    dp200.write_attribute :id, 222
    sleep 1
    dp500 = dp200.upd(500, @ds1_80)

    ## restore 200
    restoredp = dp500.upd(dp200.value, dp200.data_source)
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(restoredp.current).to eq(true), 'restored dp=200 is not current'
    expect(restoredp.read_attribute :id).to eq(222), 'restored dp not identical to dp=200'
    expect(restoredp.value_equal_to? dp200.value).to eq(true), 'dp=200 not set to current'

    ## restore 100
    restoredp = restoredp.upd(@dp.value, @dp.data_source)
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(restoredp.current).to eq(true), 'restored dp=100 is not current'
    expect(restoredp.read_attribute :id).to eq(@arbitrary_id), 'restored dp not identical to original @dp=100'
    expect(restoredp.value_equal_to? @dp.value).to eq(true), 'orig @dp=100 not set to current'

    restoredp.delete
    cdp = @s.current_data_points
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.read_attribute :id).to eq(222), 'current dp is not dp=200'
    expect(dp200.current).to eq(true), 'dp=200 not set to current'
    expect(dp500.current).to eq(false), 'dp=500 set wrongly to current'
    expect(@s.data_points.count).to eq(2), 'not exactly two dps for this series'
  end

  xit 'should NOT change current dp when non-current dp is deleted' do
    ##### this is not right... latest updated needs to be not the same as current
    sleep 1
    dp = @dp.upd(200, @ds1_80)
    sleep 1
    dp400 = dp.upd(400, @ds1_80)
    sleep 1 ## make sure updated_at changes
    dp = dp400.upd(300, @ds1_80)
    sleep 1
    dp = dp.upd(500, @ds1_80)
    cdp = @s.current_data_points
    expect(dp.current).to eq(true), 'new dp not set to current'
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 500).to eq(true), 'correct dp=500 not restored to current'
    expect(@s.data_points.count).to eq(5), 'not exactly five dps in this series'

    dp400.delete
    cdp = @s.current_data_points

    expect(dp.current).to eq(true), 'original current dp no longer set to current'
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 500).to eq(true), 'dp=500 does not remain as current'
    expect(@s.data_points.count).to eq(4), 'not exactly four dps for this series'
  end
end
